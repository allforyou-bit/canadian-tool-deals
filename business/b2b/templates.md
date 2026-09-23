# B2B Email Templates: Move-in / Move-out Cleaning

**High-English branch only** (memo §9, "English comfort: High"). If English is not comfortable, do not use this kit; see `README.md` (Korean). The owner sends each email personally, one at a time, from their own account. The AI drafts; it never sends. Not legal advice.

Every template below has the same **CASL footer**: business name, mailing address, phone, email and website, plus an unsubscribe sentence (CASL s.6(2), s.11; SOR/2012-36 s.2(1)(d); memo F11, F13). Do not remove or shorten it. Body text is **3 sentences or fewer**.

## Before you send (every email)

- [ ] The recipient's row is in `lead-sheet.csv` with a `source_url_where_published`, `no_solicitation_statement_present_YN` = `N`, a role-relevance reason, and an empty `unsubscribed_date` (memo §6: "B2B email goes only to conspicuously published, role-relevant addresses with no 'no solicitation' statement. Keep the evidence URL for each (s.10(9), s.13).")
- [ ] Every `{PLACEHOLDER}` is replaced, including the footer. `{MAILING_ADDRESS}` is a real mailing address (whether a PO box is enough is not stated in SOR/2012-36; memo F13)
- [ ] `{MOVEOUT_FROM}` matches the live price book (see the placeholder table)
- [ ] Sent individually, plain text, no BCC lists. Write `sent_date` in the lead sheet

## Placeholders

| Placeholder | Fill with |
|---|---|
| `{BRAND}` | Brand name from `config/business.ts` (`brand.en`, default "Neighbourhood Home Care") |
| `{OWNER_NAME}` | Your name |
| `{MAILING_ADDRESS}` | Your business mailing address (`NEXT_PUBLIC_MAILING_ADDRESS`) |
| `{PHONE}` | Your business phone (`NEXT_PUBLIC_PHONE`) |
| `{EMAIL}` | The address you send from and read replies at; keep it working at least 60 days after sending (CASL s.11(2)) |
| `{SITE}` | Your website (`NEXT_PUBLIC_SITE_URL`) |
| `{AREA}` | Your service area (`NEXT_PUBLIC_AREA_EN`) |
| `{FIRST_NAME}` | Recipient's first name, if published; otherwise "Hello," |
| `{SOURCE_PAGE}` | Where you found the address, in plain words, e.g. "your company's Contact page". Must match the lead-sheet URL |
| `{MOVEOUT_FROM}` | The 1-bedroom move-out price in `config/prices.ts` (`tiers[bedrooms 1].moveOut`). **GTA default: $260. It must match the live price book before sending.** |
| `{ESTIMATE_LOW}`, `{ESTIMATE_HIGH}` | The range from the website's quote calculator (`lib/quote.ts`). Do not work it out by hand |
| Others (`{ADDRESS}`, `{DATE}`, `{DATE_SENT}`, `{BEDROOMS}`, `{BATHROOMS}`, `{ADD_ONS_TEXT}`, `{REFERRER_FULL_NAME}`, `{LAST_JOB_ADDRESS}`, `{LAST_JOB_DATE}`, `{ORIGINAL_SUBJECT}`, `{THEIR_SUBJECT}`) | As named |

**Never add:** "insured" before the policy is bound; "bonded", "licensed", "certified"; reviews, client counts, years in business, "since 20XX", awards, "guarantee", "best", "#1"; HST while unregistered (memo F7).

---

### T1. Property manager: first email

Use only for a row that passes all checks in `README.md` section 3.

**Subject:** Move-out cleaning for your rental units in {AREA}

```
Hi {FIRST_NAME},

I found your address on {SOURCE_PAGE} and am writing because you look after rental units in {AREA}. {BRAND} does flat-rate move-out cleans, from {MOVEOUT_FROM} for a 1-bedroom, with an instant estimate at {SITE} and the final price confirmed from photos or on site. If a unit is turning over soon, reply with the address and move-out date and I will send a quote.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

**Once the CGL policy is bound** (and your broker confirms you can provide a certificate), swap sentences 2 and 3 for these two, so the body stays at 3 sentences:
`{BRAND} does flat-rate move-out cleans from {MOVEOUT_FROM} for a 1-bedroom and carries general liability insurance, with a certificate available on request. If a unit is turning over soon, reply with the address and move-out date, or get an instant estimate at {SITE}.`

---

### T2. Realtor: first email

Use only for a row that passes all checks in `README.md` section 3. If you work in English and Korean, you may write "{BRAND} (English and Korean)" in the second sentence.

**Subject:** Move-in and move-out cleaning for your clients in {AREA}

```
Hi {FIRST_NAME},

I found your address on {SOURCE_PAGE} and thought this could help when your buyers or sellers are moving in {AREA}. {BRAND} does flat-rate move-in and move-out cleans, from {MOVEOUT_FROM} for a 1-bedroom, with an instant estimate at {SITE} and the final price confirmed from photos or on site. If a closing is coming up, reply with the address and date and I will send a quote.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

---

### T3. Follow-up: once only

Send **once**, at least 7 days after T1 or T2, only if there was no reply and no unsubscribe (owner rule, see `README.md` section 4). Never send a second follow-up.

**Subject:** Re: {ORIGINAL_SUBJECT}

```
Hi {FIRST_NAME},

Just following up once on my note of {DATE_SENT} about move-out cleaning in {AREA}. If a unit or closing is coming up, reply with the address and date, or get an instant estimate at {SITE}. If this is not relevant to your role, reply "unsubscribe" and I will not write again.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

---

### T4. Reply to an inquiry or quote request (they wrote first)

A reply to an inquiry is excluded from CASL s.6 (SOR/2013-221 s.3(b)), and a requested quote is exempt from consent only (CASL s.6(6)(a)), so the footer still goes in (memo F11, F12). Their inquiry gives 6 months of implied consent (CASL s.10(10)); write the inquiry date in the CRM. Take `{ESTIMATE_LOW}`–`{ESTIMATE_HIGH}` from the quote calculator. No HST line while you are unregistered.

**Subject:** Re: {THEIR_SUBJECT}

```
Hi {FIRST_NAME},

Thanks for asking about a move-out clean at {ADDRESS} on {DATE}. For {BEDROOMS} bedrooms and {BATHROOMS} bathrooms{ADD_ONS_TEXT}, the estimate is {ESTIMATE_LOW}–{ESTIMATE_HIGH}, confirmed from photos or on site. Reply "yes" to book, and tell me who will let me in: someone on site or your lockbox works, as I do not hold keys.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

`{ADD_ONS_TEXT}` example: `, plus inside the oven and fridge` (add-ons are listed in `config/prices.ts`). Leave it empty if there are none.

---

### T5. Referral: first message only

Use only when someone who knows **both** you and the recipient referred you. The first message must give the referrer's **full name** and say it is sent because of the referral (SOR/2013-221 s.4(1); memo F12). Only this first message is covered; after it, you need their reply (an inquiry) or their consent before writing again.

**Subject:** {REFERRER_FULL_NAME} suggested I contact you about move-out cleaning

```
Hi {FIRST_NAME},

{REFERRER_FULL_NAME} referred me to you, and I am writing as a result of that referral. {BRAND} does flat-rate move-in and move-out cleans in {AREA}, from {MOVEOUT_FROM} for a 1-bedroom, with an instant estimate at {SITE}. If a unit or closing is coming up, reply with the address and date and I will send a quote.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

---

### T6. Existing B2B client: after a completed, paid job

A purchase in the last 2 years is an existing business relationship, which gives implied consent (CASL s.10(10)). Send at most once per completed job (owner rule).

**Subject:** Next move-out clean in {AREA}?

```
Hi {FIRST_NAME},

Thank you for booking the move-out clean at {LAST_JOB_ADDRESS} on {LAST_JOB_DATE}. If another unit is turning over, reply with the address and date and I will send a quote, or get an instant estimate at {SITE}.

Thanks,
{OWNER_NAME}

--
{BRAND}
{MAILING_ADDRESS}
{PHONE} | {EMAIL} | {SITE}
To stop receiving emails from {BRAND}, reply "unsubscribe" or write to {EMAIL}, and we will remove you from our list.
```

---

## When someone unsubscribes

Log it in `unsubscribe-log.csv` the same day, fill `unsubscribed_date` in `lead-sheet.csv`, and never email that address again. The legal limit is 10 business days (CASL s.11(3)); the owner rule is the same day. Do not send a confirmation email (whether one is allowed was not researched).

Sources: memo §6 (Marketing, CASL), §9 (English branch), §10 item 10; F7, F11, F12, F13; [CASL](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml), [SOR/2012-36](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2012-36.xml), [SOR/2013-221](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2013-221.xml). Price: `config/prices.ts`.
