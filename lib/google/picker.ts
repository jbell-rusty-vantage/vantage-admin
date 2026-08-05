"use client";

import type { GooglePickerBootstrap } from "@/lib/api/googleDrive";
import {
  interpretPickerCallback,
  type PickerDoc,
} from "@/lib/google/pickerCallback";

type GooglePickerDocsView = {
  setIncludeFolders: (include: boolean) => GooglePickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  setMimeTypes: (mimeTypes: string) => GooglePickerDocsView;
};

type GooglePickerBuilder = {
  setAppId: (appId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  enableFeature: (feature: unknown) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

type GooglePickerResponse = {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    url?: string;
    parentId?: string;
    mimeType?: string;
  }>;
};

declare global {
  interface Window {
    gapi?: {
      load: (name: string, callback: () => void) => void;
    };
    google?: {
      picker: {
        Action: { PICKED: string; CANCEL: string };
        Feature: { NAV_HIDDEN: string };
        ViewId: { FOLDERS: string; SPREADSHEETS: string };
        DocsView: new (viewId?: string) => GooglePickerDocsView;
        PickerBuilder: new () => GooglePickerBuilder;
      };
    };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function loadPickerScript(): Promise<void> {
  if (pickerScriptPromise) return pickerScriptPromise;
  pickerScriptPromise = new Promise((resolve, reject) => {
    if (window.gapi && window.google?.picker) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-vantage-picker="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Picker script failed to load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.vantagePicker = "true";
    script.onload = () => {
      if (!window.gapi) {
        reject(new Error("Google API client did not initialize."));
        return;
      }
      window.gapi.load("picker", () => resolve());
    };
    script.onerror = () => reject(new Error("Google Picker script failed to load."));
    document.head.appendChild(script);
  });
  return pickerScriptPromise;
}

export async function openGooglePicker(input: {
  bootstrap: GooglePickerBootstrap;
  title: string;
}): Promise<PickerDoc> {
  await loadPickerScript();
  const picker = window.google?.picker;
  if (!picker) {
    throw new Error("Google Picker is unavailable in this browser.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const view =
      input.bootstrap.flow === "folder"
        ? new picker.DocsView(picker.ViewId.FOLDERS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
        : new picker.DocsView(picker.ViewId.SPREADSHEETS).setMimeTypes(
            input.bootstrap.views[0]?.mime_type ?? "application/vnd.google-apps.spreadsheet",
          );

    const builder = new picker.PickerBuilder()
      .setAppId(input.bootstrap.picker_app_id)
      .setDeveloperKey(input.bootstrap.picker_api_key)
      .setOAuthToken(input.bootstrap.access_token)
      .addView(view)
      .setTitle(input.title)
      .enableFeature(picker.Feature.NAV_HIDDEN)
      .setCallback((data) => {
        if (settled) return;
        const result = interpretPickerCallback(data, picker.Action);
        if (result.kind === "ignore") return;
        settled = true;
        if (result.kind === "cancel") {
          reject(new Error("Picker selection was cancelled."));
          return;
        }
        if (result.kind === "error") {
          reject(new Error(result.message));
          return;
        }
        resolve(result.doc);
      })
      .build();

    builder.setVisible(true);
  });
}

/** Access tokens from bootstrap must never be persisted; callers should discard after verify. */
export function assertPickerBootstrapAllowlist(payload: Record<string, unknown>): void {
  const allowed = new Set([
    "picker_api_key",
    "picker_app_id",
    "access_token",
    "access_token_expires_at",
    "flow",
    "views",
    "selection_nonce",
    "connection_health",
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Error(`Unexpected Picker bootstrap field: ${key}`);
    }
  }
}
