# Checkout Test Checklist — mobile, India

Run this on a **phone** (one Android and one iPhone if possible), on mobile data, **before any ad spend**. Do one real ₹199 purchase (refund it afterwards if you like) plus one failed/cancelled payment.

Checkout option under review: **SuperProfile** (superprofile.bio). Its site says you can sell digital products by uploading a PDF and setting a price, and its pricing page says **0% commission fee** (paid plan $4.99 first month, then $29/month; checked 19 Nov 2026). **Not verified:** UPI support, payment-gateway fees, settlement timing, automatic delivery email, and Meta Pixel / Conversions API purchase events. Each one is a check below. If any check fails, use another checkout or the site's own (`tools.creativecut.in` already offers ₹ checkout via UPI/cards for Creative Captions, so that route may be reusable).

## A. Setup (desktop is fine)
- [ ] Product created: title "GTA 6 Creator Toolkit", price ₹199 (INR), file `GTA_6_Creator_Toolkit.pdf` uploaded
- [ ] Product page shows Creative Cut as the seller name (no personal name)
- [ ] Cover image `GTA_6_Creator_Toolkit_Cover.png` and preview image added
- [ ] Refund policy, contact email and terms are linked on the page
- [ ] Invoice/receipt settings: business name, and GST details if applicable (check with an accountant)
- [ ] Payment-gateway fee per transaction written down: ______ %, so net per sale = ₹______
- [ ] Meta Pixel (and Conversions API if offered) connected. Purchase event set to fire on the **paid** confirmation, with value 199 and currency INR

## B. Mobile checkout (phone, 375–390 px wide)
- [ ] Page loads in under 3 s on 4G; no horizontal scroll; CTA visible without zooming
- [ ] Price shows **₹199** everywhere (page, checkout, receipt)
- [ ] **UPI** appears as a method: UPI intent (GPay/PhonePe/Paytm opens) ✔ / UPI ID ✔ / QR ✔
- [ ] Returning from the UPI app lands back on the confirmation page (not a blank or timeout screen)
- [ ] Card payment works (optional second test)
- [ ] Buyer email and phone fields validate; autofill works

## C. Payment confirmation
- [ ] Confirmation page says the payment succeeded and how to get the PDF
- [ ] Order appears in the dashboard as **paid** with the correct amount
- [ ] Failed/cancelled UPI payment shows a clear retry message and does **not** create a paid order or send the file

## D. PDF delivery
- [ ] Download link on the confirmation page works on the phone
- [ ] Delivery email arrives within 5 minutes (check spam/promotions); sender name shows Creative Cut
- [ ] The downloaded file opens in the phone's PDF viewer; 36 pages; cover on page 1
- [ ] Bookmarks/contents links work in Google Drive PDF viewer / Files app
- [ ] Download link limits/expiry noted: ______

## E. Purchase event verification
- [ ] Meta Events Manager → Test events: **Purchase** event received once per paid order (not on page view or failed payment)
- [ ] Value = 199, currency = INR, no duplicates
- [ ] Event is attributed to the test ad click (use a test campaign link with UTM parameters)
- [ ] Note the dashboard order ID next to the Meta event time for reconciliation

## F. Sign-off
| Check | Android | iPhone | Notes |
|---|---|---|---|
| UPI paid order | | | |
| Failed payment handled | | | |
| PDF delivered | | | |
| Purchase event once | | | |

Only start the ₹750 ad test (see `launch-copy.md` §4) when every row is ✔. Publication and ad spend are the owner's decision.
