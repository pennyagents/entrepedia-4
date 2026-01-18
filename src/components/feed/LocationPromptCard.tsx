import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LocationPromptCardProps {
  onLocationSet?: () => void;
}

export function LocationPromptCard({ onLocationSet }: LocationPromptCardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if user already has location or dismissed
  if (!user || profile?.location || dismissed) {
    return null;
  }

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support location services',
        variant: 'destructive',
      });
      return;
    }

    setFetchingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Use free reverse geocoding service (Nominatim/OpenStreetMap)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          const data = await response.json();

          // Extract city/town and country from the response
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.state;
          const country = data.address?.country;

          const locationString = [city, country].filter(Boolean).join(', ');
          const finalLocation = locationString || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

          // Save to profile
          const { error } = await supabase
            .from('profiles')
            .update({ location: finalLocation })
            .eq('id', user.id);

          if (error) throw error;

          await refreshProfile();
          toast({ title: 'Location saved!', description: `Your location: ${finalLocation}` });
          onLocationSet?.();
        } catch (error) {
          console.error('Error saving location:', error);
          toast({
            title: 'Error saving location',
            description: 'Please try again or set it in Settings',
            variant: 'destructive',
          });
        } finally {
          setFetchingLocation(false);
        }
      },
      (error) => {
        setFetchingLocation(false);
        let message = 'Unable to get your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Please allow location access in your browser settings';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }

        toast({ title: 'Location error', description: message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <Card className="border-0 shadow-soft bg-gradient-to-r from-primary/10 to-accent/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/20">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Share your location</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Find nearby friends, communities, and businesses in your area
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="gradient-primary text-white"
                onClick={handleGetLocation}
                disabled={fetchingLocation}
              >
                {fetchingLocation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Use my location
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
              >
                Not now
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 h-8 w-8"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
