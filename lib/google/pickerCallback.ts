export type PickerDoc = {
  id: string;
  name: string;
  url?: string;
  parentId?: string;
};

export type PickerCallbackData = {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    url?: string;
    parentId?: string;
    mimeType?: string;
  }>;
};

export type PickerActions = {
  PICKED: string;
  CANCEL: string;
};

export type PickerCallbackInterpretation =
  | { kind: "ignore" }
  | { kind: "cancel" }
  | { kind: "picked"; doc: PickerDoc }
  | { kind: "error"; message: string };

/**
 * Google Picker fires intermediate actions (notably LOADED) before PICKED/CANCEL.
 * Only terminal actions should settle the promise.
 */
export function interpretPickerCallback(
  data: PickerCallbackData,
  actions: PickerActions,
): PickerCallbackInterpretation {
  if (data.action === actions.CANCEL) {
    return { kind: "cancel" };
  }
  // Google fires intermediate actions (notably LOADED) before PICKED/CANCEL.
  if (data.action !== actions.PICKED) {
    return { kind: "ignore" };
  }
  const doc = data.docs?.[0];
  if (!doc?.id) {
    return { kind: "error", message: "Picker did not return a file ID." };
  }
  return {
    kind: "picked",
    doc: {
      id: doc.id,
      name: doc.name,
      url: doc.url,
      parentId: doc.parentId,
    },
  };
}
