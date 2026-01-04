"use client";

import { useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { Smile } from "lucide-react";

interface EmojiPickerButtonProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export function EmojiPickerButton({
  value,
  onChange,
  placeholder = "🎨",
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-16 h-10 text-2xl p-0 hover:scale-105 transition-transform"
          type="button"
        >
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0" align="start">
        <EmojiPicker
          onEmojiClick={(emojiData) => {
            onChange(emojiData.emoji);
            setOpen(false);
          }}
          theme={Theme.LIGHT}
          searchPlaceholder="Søk emoji..."
          previewConfig={{
            showPreview: false,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
