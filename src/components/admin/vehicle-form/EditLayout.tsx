import { CreateWizard, type WizardLayoutProps } from "./CreateWizard";

// A edição mantém as etapas; M5 evolui suas ações sem alterar o cadastro.
export function EditLayout(props: WizardLayoutProps) {
  return <CreateWizard {...props} />;
}
