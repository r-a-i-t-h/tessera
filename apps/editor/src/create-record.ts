export type CreatedRecordMode = "arrange" | "compose" | "fields" | "raw";

export type CreateRecordDestination = {
  hash: string;
  mode: CreatedRecordMode;
  notice: string;
};

export type CreateRecordOptions = {
  kind: string;
  form: HTMLFormElement;
  idField: string;
  existingIds: readonly string[];
  validateId: (id: string, existingIds: readonly string[]) => string | undefined;
  buildBody: (id: string) => unknown | Promise<unknown>;
  save: (kind: string, id: string, body: unknown) => Promise<unknown>;
  destinationMode: CreatedRecordMode;
  destinationHash: (id: string) => string;
  successMessage: (id: string) => string;
  failureMessage: string;
  showError: (form: HTMLFormElement, message: string) => void;
  afterSave?: (id: string, notice: string) => string | Promise<string>;
  navigate: (destination: CreateRecordDestination) => void | Promise<void>;
};

export async function createRecord(options: CreateRecordOptions): Promise<void> {
  const id = options.form.querySelector<HTMLInputElement>(options.idField)?.value ?? "";
  const problem = options.validateId(id, options.existingIds);
  if (problem) {
    options.showError(options.form, problem);
    return;
  }

  const button = options.form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const recordId = id.trim();
  try {
    const body = await options.buildBody(recordId);
    await options.save(options.kind, recordId, body);
  } catch (err) {
    options.showError(
      options.form,
      err instanceof Error ? err.message : options.failureMessage,
    );
    if (button) button.disabled = false;
    return;
  }

  let notice = options.successMessage(recordId);
  if (options.afterSave) notice = await options.afterSave(recordId, notice);
  await options.navigate({
    hash: options.destinationHash(recordId),
    mode: options.destinationMode,
    notice,
  });
}
