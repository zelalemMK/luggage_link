import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchAirports, Airport } from "@/data/airports";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AirportInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (airportCode: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MIN_QUERY_LENGTH = 1;
const MAX_RESULTS = 8;
const SEARCH_DELAY_MS = 150;

export function AirportInput({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = "Enter airport code or name", 
  className,
  disabled = false,
}: AirportInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSearchRef = useRef(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const trimmedQuery = useMemo(() => inputValue.trim(), [inputValue]);

  const performSearch = useCallback(
    (query: string) => {
      if (query.length < MIN_QUERY_LENGTH) {
        setAirports([]);
        setOpen(false);
        return;
      }

      const results = searchAirports(query);
      const ranked = rankAirports(results, query).slice(0, MAX_RESULTS);
      setAirports(ranked);
      setOpen(ranked.length > 0);
    },
    []
  );

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      setIsSearching(false);
      setAirports([]);
      setOpen(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setAirports([]);
      setOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(trimmedQuery.toLowerCase());
      setIsSearching(false);
    }, SEARCH_DELAY_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [trimmedQuery, performSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSelect = (airport: Airport) => {
    suppressSearchRef.current = true;
    setInputValue(airport.code);
    onChange(airport.code);
    onSelectSuggestion?.(airport.code);
    setAirports([]);
    setOpen(false);
  };

  const suggestionMessage =
    trimmedQuery.length < MIN_QUERY_LENGTH
      ? "Start typing to search airports."
      : airports.length === 0 && !isSearching
        ? "No airports found."
        : null;

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        disabled={disabled}
        onFocus={() => {
          if (airports.length > 0) {
            setOpen(true);
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground"
        onClick={() => {
          if (airports.length > 0) {
            setOpen((prev) => !prev);
          } else if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
            performSearch(trimmedQuery.toLowerCase());
          }
        }}
        disabled={disabled}
      >
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronsUpDown className="h-4 w-4" />
        )}
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-md">
          {suggestionMessage ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {suggestionMessage}
            </div>
          ) : (
            <ScrollArea className="max-h-60">
              <div className="flex flex-col p-1">
                {airports.map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onMouseDown={(event) => event.preventDefault()} // keep input focus
                    onClick={() => handleSelect(airport)}
                    disabled={disabled}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{airport.code}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="truncate">
                        {highlightQuery(airport.name, trimmedQuery)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {highlightQuery(
                        `${airport.city}, ${airport.country}`,
                        trimmedQuery
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

function rankAirports(airports: Airport[], query: string): Airport[] {
  if (!query) return [];
  const normalizedQuery = query.toLowerCase();
  return [...airports].sort(
    (a, b) => scoreAirport(b, normalizedQuery) - scoreAirport(a, normalizedQuery)
  );
}

function scoreAirport(airport: Airport, query: string): number {
  const code = airport.code.toLowerCase();
  const name = airport.name.toLowerCase();
  const city = airport.city.toLowerCase();
  const country = airport.country.toLowerCase();

  if (code === query) return 100;
  if (code.startsWith(query)) return 90;
  if (name.startsWith(query)) return 70;
  if (city.startsWith(query)) return 60;

  let score = 0;
  if (code.includes(query)) score = Math.max(score, 50);
  if (name.includes(query)) score = Math.max(score, 40);
  if (city.includes(query)) score = Math.max(score, 30);
  if (country.includes(query)) score = Math.max(score, 20);
  return score;
}

function highlightQuery(text: string, query: string) {
  if (!query) return text;
  const normalizedQuery = query.toLowerCase();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const segments = text.split(regex);

  return segments.map((segment, index) =>
    segment.toLowerCase() === normalizedQuery ? (
      <span key={`${segment}-${index}`} className="font-semibold text-primary">
        {segment}
      </span>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    )
  );
}