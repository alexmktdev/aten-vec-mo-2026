import { NextResponse } from "next/server";
import { ZodIssue } from "zod";

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: ZodIssue[];
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function createSuccessResponse<T>(data: T, message?: string, status: number = 200) {
  const body: SuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  return NextResponse.json(body, { status });
}

export function createErrorResponse(
  status: number,
  message: string,
  details?: ZodIssue[]
) {
  const body: ErrorResponse = { success: false, error: message };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}
