# DHS MEDIA Payment Setup

## Provider

Use payOS for checkout links/QR payment and Resend for delivery emails.

## Vercel environment variables

Required for payment:

```text
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PUBLIC_SITE_URL=https://dhs-media.vercel.app
```

Required for automatic delivery email:

```text
RESEND_API_KEY=
MAIL_FROM=DHS MEDIA <your-verified@email-domain.com>
```

## payOS webhook

Set the payOS webhook URL to:

```text
https://dhs-media.vercel.app/api/payments/payos-webhook
```

After webhook receives a paid event, the server reads `data/orders.json`, marks the order paid, and sends the product `promptUrl` to the buyer email.

## Product requirements

Every paid product must have:

- `price`: numeric VND text, for example `99000` or `99.000đ`
- `promptUrl`: product delivery link

If `price` is `0đ` or `Liên hệ`, the checkout API will reject the product until a real price is set in Google Sheet.
