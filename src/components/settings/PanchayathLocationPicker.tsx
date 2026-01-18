import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Kerala Districts with their Panchayaths (sample data - expandable)
const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
];

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function PanchayathLocationPicker({ value, onChange }: LocationPickerProps) {
  const [panchayath, setPanchayath] = useState('');
  const [ward, setWard] = useState('');
  const [district, setDistrict] = useState('');
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  // Parse existing location value
  useEffect(() => {
    if (value) {
      const parts = value.split(',').map(s => s.trim());
      if (parts.length >= 1) setPanchayath(parts[0] || '');
      if (parts.length >= 2) setWard(parts[1] || '');
      if (parts.length >= 3) setDistrict(parts[2] || '');
    }
  }, []);

  // Update parent when location changes
  useEffect(() => {
    const locationParts = [panchayath, ward, district].filter(Boolean);
    if (locationParts.length > 0) {
      onChange(locationParts.join(', '));
    }
  }, [panchayath, ward, district]);

  // Search for places using Nominatim (OpenStreetMap) - free API
  const searchPlaces = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search for panchayaths/villages in Kerala, India
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query + ' panchayat Kerala India')}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=10&` +
        `countrycodes=in`
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      
      // Extract unique place names
      const places = data.map((item: any) => {
        const parts = [];
        
        // Get village/town/city name
        const placeName = item.address?.village || 
                         item.address?.town || 
                         item.address?.city ||
                         item.address?.suburb ||
                         item.name;
        
        if (placeName) parts.push(placeName);
        
        // Get district
        const districtName = item.address?.county || 
                            item.address?.state_district ||
                            item.address?.district;
        
        if (districtName && !parts.includes(districtName)) {
          parts.push(districtName);
        }
        
        return parts.join(', ');
      }).filter((name: string, index: number, arr: string[]) => 
        name && arr.indexOf(name) === index
      );
      
      setSearchResults(places);
    } catch (error) {
      console.error('Place search error:', error);
      // Fallback to local Kerala districts
      const filtered = KERALA_DISTRICTS.filter(d => 
        d.toLowerCase().includes(query.toLowerCase())
      ).map(d => `${query}, ${d}`);
      setSearchResults(filtered.length > 0 ? filtered : [`${query}, Kerala`]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 500);
  };

  const handleSelectPlace = (place: string) => {
    const parts = place.split(',').map(s => s.trim());
    setPanchayath(parts[0] || '');
    if (parts.length > 1) {
      setDistrict(parts[1] || '');
    }
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Panchayath / Municipality</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className={cn(!panchayath && "text-muted-foreground")}>
                  {panchayath || "Search your panchayath..."}
                </span>
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 z-50" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Type panchayath name..." 
                value={searchQuery}
                onValueChange={handleSearchChange}
              />
              <CommandList>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <CommandEmpty>
                    {searchQuery.length < 3 
                      ? "Type at least 3 characters to search" 
                      : "No panchayath found. Try a different name."}
                  </CommandEmpty>
                ) : (
                  <CommandGroup heading="Suggestions">
                    {searchResults.map((place) => (
                      <CommandItem
                        key={place}
                        value={place}
                        onSelect={() => handleSelectPlace(place)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            panchayath === place.split(',')[0]?.trim() 
                              ? "opacity-100" 
                              : "opacity-0"
                          )}
                        />
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        {place}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Start typing your panchayath or municipality name
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ward">Ward Number / Name</Label>
          <Input
            id="ward"
            placeholder="e.g., Ward 5 or Mullakkal"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal"
              >
                {district || "Select district"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 z-50" align="start">
              <Command>
                <CommandInput placeholder="Search district..." />
                <CommandList>
                  <CommandEmpty>No district found.</CommandEmpty>
                  <CommandGroup>
                    {KERALA_DISTRICTS.map((d) => (
                      <CommandItem
                        key={d}
                        value={d}
                        onSelect={() => setDistrict(d)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            district === d ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {d}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {(panchayath || ward || district) && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium text-foreground">Your Location:</p>
          <p className="text-sm text-muted-foreground">
            {[panchayath, ward, district].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
