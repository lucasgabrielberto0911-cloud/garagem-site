import { btn } from "@/components/admin/ui";

export function SubmitButton({
  label,
  pending,
  disabled,
}: {
  label: string;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${btn.primary} w-full sm:w-auto`}
    >
      {pending ? "Salvando..." : disabled ? "Aguarde as fotos..." : label}
    </button>
  );
}
