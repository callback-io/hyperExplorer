import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
}

// 内部组件：在每次对话框打开时重新挂载
function InputDialogContent(props: {
  title: string;
  description?: string;
  defaultValue: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { title, description, defaultValue, placeholder, onConfirm, onCancel } = props;

  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // 仅在挂载时聚焦，不调用 setState
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="py-4">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={!value.trim()}>
          {t("common.confirm")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function InputDialog(props: InputDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    defaultValue = "",
    placeholder,
    onConfirm,
  } = props;

  const handleConfirm = (value: string) => {
    onConfirm(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <InputDialogContent
          key={String(open)}
          title={title}
          description={description}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
