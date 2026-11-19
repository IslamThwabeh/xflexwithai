export function buildOrderKeySupportMessage(orderId: number, keys: string[]) {
  return `تم تأكيد الدفع لطلبك #${orderId} ✅\nمفتاح التفعيل الخاص بك:\n${keys.join('\n')}\n\n` +
    'المفتاح محفوظ هنا حتى لو لم يصلك البريد. سجّل الدخول بالحساب المرتبط ببريد الطلب، ثم افتح صفحة تفعيل المفتاح وأدخله لتفعيل باقتك. اعتماد الطلب وحده لا يفعّل الوصول.\n' +
    'https://xflexacademy.com/activate-key\nإذا احتجت مساعدة، رد علينا هنا. لا تشارك المفتاح خارج حسابك.\n\n' +
    `Payment for order #${orderId} is confirmed. Your activation key is saved above, even if the email does not arrive. ` +
    'Sign in with the account matching the order recipient email and enter the key on the activation page to activate your package. Reply here if you need help.';
}

/** Support context goes to an external AI provider; credentials must stay out. */
export function redactActivationKeys(content: string) {
  return content.replace(/\bXFLEX(?:-[A-Z0-9]+){2,}\b/gi, '[activation key hidden]');
}
