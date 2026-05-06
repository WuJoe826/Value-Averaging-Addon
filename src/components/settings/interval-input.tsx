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

interface IntervalOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface IntervalInputProps<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: IntervalOption<TValue>[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function IntervalInput<TValue extends string>({
  value,
  onChange,
  options,
  placeholder = "Select an interval",
  searchPlaceholder = "Search option...",
  emptyText = "No option found.",
  disabled = false,
  className,
}: IntervalInputProps<TValue>) {
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

  const handleSelect = (optionValue: TValue) => {
    onChange(optionValue);
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
          disabled={disabled}
          className={cn("h-input-height w-full justify-between rounded-md", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <Icons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
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
