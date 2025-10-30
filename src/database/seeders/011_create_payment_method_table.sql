-- Main payment methods
INSERT INTO payment_methods (code, label, description, icon)
VALUES
('card', 'Payment Card', 'Pay using Visa, Mastercard, or Verve', '/uploads/payment-icons/card.png'),
('momo', 'Mobile Money', 'Pay using MTN, Vodafone, AirtelTigo, or Telecel', '/uploads/payment-icons/momo.png'),
('cod', 'Cash on Delivery', 'Pay when your order is delivered', '/uploads/payment-icons/cod.png')
ON CONFLICT (code) DO NOTHING;
