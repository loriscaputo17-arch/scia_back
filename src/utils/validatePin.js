function validatePin(pin) {
  if (!/^\d{8}$/.test(pin))
    return { valid: false, error: "Il PIN deve essere di esattamente 8 cifre." };
  if (/^(\d)\1{7}$/.test(pin))
    return { valid: false, error: "Il PIN non può avere tutte le cifre uguali." };
  if ("0123456789".includes(pin) || "9876543210".includes(pin))
    return { valid: false, error: "Il PIN non può essere una sequenza." };
  if (/^(\d{2})\1{3}$/.test(pin))
    return { valid: false, error: "Il PIN è troppo ripetitivo." };
  if (/^(\d{4})\1$/.test(pin))
    return { valid: false, error: "Il PIN è troppo ripetitivo." };
  return { valid: true };
}

module.exports = { validatePin };
