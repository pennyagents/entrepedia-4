import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CommunityPermissionType = 
  | 'edit_community' 
  | 'create_polls' 
  | 'moderate_discussions' 
  | 'manage_members';

interface CommunityPermission {
  id: string;
  user_id: string;
  community_id: string;
  permission: CommunityPermissionType;
  granted_by: string | null;
  granted_at: string | null;
}

interface MemberWithPermissions {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  permissions: CommunityPermissionType[];
}

interface UseCommunityPermissionsReturn {
  permissions: CommunityPermissionType[];
  allPermissions: CommunityPermission[];
  membersWithPermissions: MemberWithPermissions[];
  loading: boolean;
  isCreator: boolean;
  hasPermission: (permission: CommunityPermissionType) => boolean;
  canEdit: boolean;
  canCreatePolls: boolean;
  canModerateDiscussions: boolean;
  canManageMembers: boolean;
  grantPermission: (userId: string, permission: CommunityPermissionType) => Promise<boolean>;
  revokePermission: (userId: string, permission: CommunityPermissionType) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useCommunityPermissions(communityId: string | undefined): UseCommunityPermissionsReturn {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<CommunityPermissionType[]>([]);
  const [allPermissions, setAllPermissions] = useState<CommunityPermission[]>([]);
  const [membersWithPermissions, setMembersWithPermissions] = useState<MemberWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch community to check if user is creator
      const { data: community } = await supabase
        .from('communities')
        .select('created_by')
        .eq('id', communityId)
        .single();

      const creatorStatus = community?.created_by === user?.id;
      setIsCreator(creatorStatus);

      // Fetch user's permissions for this community
      if (user) {
        const { data: userPermissions } = await supabase
          .from('community_permissions')
          .select('permission')
          .eq('community_id', communityId)
          .eq('user_id', user.id);

        const perms = (userPermissions || []).map(p => p.permission as CommunityPermissionType);
        setPermissions(perms);
      }

      // If creator, fetch all permissions for all members
      if (creatorStatus) {
        // Fetch all permissions
        const { data: allPerms } = await supabase
          .from('community_permissions')
          .select('*')
          .eq('community_id', communityId);

        setAllPermissions((allPerms || []) as CommunityPermission[]);

        // Fetch all members with their profiles
        const { data: members } = await supabase
          .from('community_members')
          .select(`
            user_id,
            role,
            profiles:user_id (
              full_name,
              username,
              avatar_url
            )
          `)
          .eq('community_id', communityId);

        // Combine members with their permissions
        const membersData: MemberWithPermissions[] = (members || []).map((member: any) => {
          const memberPerms = (allPerms || [])
            .filter((p: any) => p.user_id === member.user_id)
            .map((p: any) => p.permission as CommunityPermissionType);

          return {
            user_id: member.user_id,
            full_name: member.profiles?.full_name || null,
            username: member.profiles?.username || null,
            avatar_url: member.profiles?.avatar_url || null,
            role: member.role,
            permissions: memberPerms,
          };
        });

        setMembersWithPermissions(membersData);
      }
    } catch (error) {
      console.error('Error fetching community permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permission: CommunityPermissionType): boolean => {
    // Creators have all permissions
    if (isCreator) return true;
    return permissions.includes(permission);
  }, [isCreator, permissions]);

  const grantPermission = async (userId: string, permission: CommunityPermissionType): Promise<boolean> => {
    if (!user || !communityId) return false;

    try {
      const stored = localStorage.getItem('samrambhak_auth');
      const sessionToken = stored ? JSON.parse(stored).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-community', {
        body: {
          action: 'grant_permission',
          community_id: communityId,
          target_user_id: userId,
          permission,
        },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchPermissions();
      return true;
    } catch (error) {
      console.error('Error granting permission:', error);
      return false;
    }
  };

  const revokePermission = async (userId: string, permission: CommunityPermissionType): Promise<boolean> => {
    if (!user || !communityId) return false;

    try {
      const stored = localStorage.getItem('samrambhak_auth');
      const sessionToken = stored ? JSON.parse(stored).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-community', {
        body: {
          action: 'revoke_permission',
          community_id: communityId,
          target_user_id: userId,
          permission,
        },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchPermissions();
      return true;
    } catch (error) {
      console.error('Error revoking permission:', error);
      return false;
    }
  };

  return {
    permissions,
    allPermissions,
    membersWithPermissions,
    loading,
    isCreator,
    hasPermission,
    canEdit: hasPermission('edit_community'),
    canCreatePolls: hasPermission('create_polls'),
    canModerateDiscussions: hasPermission('moderate_discussions'),
    canManageMembers: hasPermission('manage_members'),
    grantPermission,
    revokePermission,
    refresh: fetchPermissions,
  };
}
