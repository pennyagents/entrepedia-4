import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, MapPin, Users, ChevronRight } from 'lucide-react';

interface SuggestedFriend {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  is_nearby: boolean;
}

export function MobileFriendSuggestions() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [friends, setFriends] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchSuggestedFriends();
    } else {
      setLoading(false);
    }
  }, [user, profile?.location]);

  const fetchSuggestedFriends = async () => {
    if (!user) return;

    try {
      // Get current user's following list
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingSet = new Set((followingData || []).map((f) => f.following_id));
      setFollowingIds(followingSet);

      const suggestions: SuggestedFriend[] = [];
      const seenIds = new Set<string>();

      // First, try to get nearby users if user has location
      if (profile?.location) {
        const locationPart = profile.location.split(',')[0]?.trim();
        if (locationPart) {
          const { data: nearbyUsers } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, location')
            .neq('id', user.id)
            .ilike('location', `%${locationPart}%`)
            .limit(6);

          (nearbyUsers || []).forEach((u) => {
            if (!followingSet.has(u.id) && !seenIds.has(u.id)) {
              seenIds.add(u.id);
              suggestions.push({ ...u, is_nearby: true });
            }
          });
        }
      }

      // Fill remaining slots with other users
      if (suggestions.length < 6) {
        const { data: otherUsers } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, location')
          .neq('id', user.id)
          .limit(10);

        (otherUsers || []).forEach((u) => {
          if (!followingSet.has(u.id) && !seenIds.has(u.id) && suggestions.length < 6) {
            seenIds.add(u.id);
            suggestions.push({ ...u, is_nearby: false });
          }
        });
      }

      setFriends(suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (friendId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const sessionToken = localStorage.getItem('session_token');
      const { error } = await supabase.functions.invoke('toggle-follow', {
        body: {
          user_id: user.id,
          following_id: friendId,
          action: 'follow',
        },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;

      setFollowingIds((prev) => new Set([...prev, friendId]));
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      toast({ title: 'Following!' });
    } catch (error: any) {
      toast({ title: 'Error following user', variant: 'destructive' });
    }
  };

  if (!user || loading) {
    if (loading) {
      return (
        <Card className="border-0 shadow-soft lg:hidden">
          <CardContent className="p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="flex gap-3 overflow-x-auto">
              {Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-32 w-28 shrink-0 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  if (friends.length === 0) return null;

  return (
    <Card className="border-0 shadow-soft lg:hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            People You May Know
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary"
            onClick={() => navigate('/friends')}
          >
            See All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 px-4">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex flex-col items-center bg-muted/30 rounded-xl p-3 w-28 shrink-0"
              >
                <div className="relative">
                  <Avatar
                    className="h-14 w-14 cursor-pointer ring-2 ring-background"
                    onClick={() => navigate(`/profile/${friend.id}`)}
                  >
                    <AvatarImage src={friend.avatar_url || ''} />
                    <AvatarFallback className="gradient-primary text-white">
                      {(friend.full_name || friend.username || 'U').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {friend.is_nearby && (
                    <Badge
                      variant="secondary"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0"
                    >
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />
                      Nearby
                    </Badge>
                  )}
                </div>
                <p
                  className="text-xs font-medium text-foreground mt-2 text-center truncate w-full cursor-pointer"
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  {friend.full_name || friend.username || 'User'}
                </p>
                <Button
                  size="sm"
                  className="mt-2 h-7 text-xs w-full gradient-primary text-white"
                  onClick={() => handleFollow(friend.id)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Follow
                </Button>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
