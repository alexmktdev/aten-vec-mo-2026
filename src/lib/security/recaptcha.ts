const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

interface RecaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

function getRecaptchaSecretKey() {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing RECAPTCHA_SECRET_KEY");
  }
  return secret;
}

export async function verifyRecaptchaToken(token: string, remoteIp?: string) {
  const secret = getRecaptchaSecretKey();
  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);
  if (remoteIp) {
    params.append("remoteip", remoteIp);
  }

  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      success: false,
      errorCodes: ["verify-request-failed"],
    };
  }

  const json = (await response.json()) as RecaptchaVerifyResult;
  return {
    success: json.success === true,
    errorCodes: json["error-codes"] || [],
  };
}
