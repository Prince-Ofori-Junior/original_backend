-- Sub-channels for Card
INSERT INTO payment_sub_channels (method_code, code, label, icon)
VALUES
('card', 'visa', 'Visa', 'src\uploads\payment-icons\1760798560831-647024509.png'),
('card', 'mastercard', 'MasterCard', 'src\uploads\payment-icons\1760798119316-347678715.png'),
('card', 'verve', 'Verve', 'src\uploads\payment-icons\1760798590536-850111774.png')
ON CONFLICT (method_code, code) DO NOTHING;

-- Sub-channels for Mobile Money
INSERT INTO payment_sub_channels (method_code, code, label, icon)
VALUES
('momo', 'mtn', 'MTN MoMo', 'src\uploads\payment-icons\mtn.png'),
('momo', 'airteltigo', 'AirtelTigo Money', 'src\uploads\payment-icons\1760798542036-68252447.png'),
('momo', 'telecel', 'Telecel Cash', 'src\uploads\payment-icons\1760798577057-71227747.png')
ON CONFLICT (method_code, code) DO NOTHING;

-- Sub-channels for Cash on Delivery
INSERT INTO payment_sub_channels (method_code, code, label, icon)
VALUES
('cod', 'pickup', 'Cash On Delivery/Pickup', 'src\uploads\payment-icons\1759417651283-151649251.png')
ON CONFLICT (method_code, code) DO NOTHING;
