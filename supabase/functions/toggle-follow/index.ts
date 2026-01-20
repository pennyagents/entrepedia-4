import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, following_id, action } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!following_id) {
      return new Response(
        JSON.stringify({ error: 'following_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user_id === following_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot follow yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAction = action === 'unfollow' ? 'unfollow' : 'follow';
    console.log(`toggle-follow: ${user_id} -> ${normalizedAction} -> ${following_id}`);

    if (normalizedAction === 'follow') {
      // Check if already following
      const { data: existing, error: existsError } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user_id)
        .eq('following_id', following_id)
        .maybeSingle();

      if (existsError) {
        console.error('Existing check error:', existsError);
        return new Response(
          JSON.stringify({ error: 'Failed to check follow status', details: existsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: 'Already following', is_following: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert new follow
      const { error: insertError } = await supabase
        .from('follows')
        .insert({ follower_id: user_id, following_id });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to follow user', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create notification for the person being followed
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user_id)
        .maybeSingle();

      const followerName = followerProfile?.full_name || followerProfile?.username || 'Someone';

      await supabase.from('notifications').insert({
        user_id: following_id,
        type: 'follow',
        title: 'New follower',
        body: `${followerName} started following you!`,
        data: { follower_id: user_id },
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Followed successfully', is_following: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // unfollow
    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user_id)
      .eq('following_id', following_id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to unfollow user', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Unfollowed successfully', is_following: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
