import type { AuthError } from "@supabase/supabase-js";

export function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-posta veya şifre hatalı.";
    case "email_not_confirmed":
      return "Önce e-posta adresini doğrula.";
    case "user_already_exists":
      return "Bu e-posta ile kayıtlı bir hesap var.";
    case "weak_password":
      return "Daha güçlü bir şifre seç (en az 6 karakter).";
    case "over_email_send_rate_limit":
      return "Çok fazla deneme oldu. Biraz sonra tekrar dene.";
    case "signup_disabled":
      return "Kayıt şu anda kapalı.";
    case "validation_failed":
      return "Girdiğin bilgileri kontrol et.";
    default:
      return "İşlem tamamlanamadı. Tekrar dene.";
  }
}
