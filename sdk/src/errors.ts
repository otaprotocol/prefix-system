import { ProgramError } from "@coral-xyz/anchor";
import IDL from "../../target/idl/prefix_system.json";

export class PrefixSystemClientError extends Error {
  public override name: string;

  constructor(message: string) {
    super(message);
    this.name = `PrefixSystemClientError`;
  }
}

export class PrefixSystemProgramError extends Error {
  public code: number;
  public override name: string;
  public message: string;
  public details: string[];

  constructor(code: number, message: string, details: string[]) {
    super(message);
    this.name = `PrefixSystemProgramError`;
    this.code = code;
    this.message = message;
    this.details = details;
  }
}

export function prettifyProgramError(error: unknown): Error {
  if (error instanceof ProgramError) {
    const errorCode = error.code;
    const errorMessage =
      IDL.errors.find((err) => err.code === errorCode)?.msg ??
      `Unknown program error (code: ${errorCode})`;
    const details = Array.isArray((error as any).logs)
      ? (error as any).logs
      : [];
    return new PrefixSystemProgramError(errorCode, errorMessage, details);
  }

  return error instanceof Error ? error : new Error(String(error));
}
