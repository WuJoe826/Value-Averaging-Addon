import { useMemo, useState } from "react";
import { Button, cn } from "@wealthfolio/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Icons,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from "@wealthfolio/ui";
import type { GrowthInterval } from "../../types";

interface IntervalOption {
  value: GrowthInterval;
  label: string;
}

interface IntervalInputProps {
  value: GrowthInterval;
  onChange: (value: GrowthInterval) => void;
  options: IntervalOption[];
  placeholder?: string;
}

export function IntervalInput({
  value,
  onChange,
  options,
  placeholder = "Select an interval",
}: IntervalInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;

  const handleSelect = (interval: GrowthInterval) => {
    onChange(interval);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-input-height w-full justify-between rounded-md", !value && "text-muted-foreground")}
        >
          <span className="truncate">{selectedLabel}</span>
          <Icons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search interval..."
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No interval found.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="max-h-72 overflow-y-auto">
                {filteredOptions.map((option) => (
                  <CommandItem key={option.value} value={option.value} onSelect={() => handleSelect(option.value)}>
                    {option.label}
                    <Icons.Check
                      className={cn("ml-auto h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
