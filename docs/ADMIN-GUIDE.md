# Aurelé admin — owner's guide

Sign in at `/admin`. Use your email and password.

Five wrong passwords lock that login for 15 minutes.

## Your login

More than one person can have an admin login. Every login can do every job. There is no separate owner account and staff account.

To change your password, open **Settings → Change password**. Type your current password, then the new one twice. The new password needs at least 10 characters, with letters and numbers. You stay signed in on this device. Every other device is signed out.

**Sign out everywhere** is on the same page. Use it if a phone is lost.

Forgot the password completely? Ask a developer to run `npm run admin:create` with your email. If that email already has a login, this sets a new password and signs that person out on every device. It does not create a second login for the same email.

## What customers can see

A piece shows on the website when the design is **Visible** and that colour or size has a **selling price**.

Untick **Visible** on a design to hide the whole design. Untick **Visible** on one row to hide just that colour or size.

No selling price means that row is hidden.

**Sold out is not hidden.** If the quantity is 0, customers still see the piece. It says sold out, and they cannot buy it.

## Photos

Always upload photos in this admin. Do not upload them on cloudinary.com. The admin saves the photo and attaches it to the design.

Open **Products**, open the design, then **Photos**.

1. Choose a JPG, PNG, or WebP. The largest file is 5 MB.
2. Set **Finish** to Gold, Silver, or Any.
3. Set **Colour** to the colour, or Any.
4. Description is optional.
5. Click **Upload photo**.

There is no limit on how many photos a design can have. Square photos around 1200×1200 work well. The site shrinks large photos.

The arrows put the photos in order. **The first photo is the picture on the product card** in the shop lists. That is true even if the first photo is tagged Gold or Silver. Move the picture you want on the card all the way to the left.

**Delete** removes that photo from the design and from the shop’s photo storage.

Tags only change the product page, not the card.

Example, Aveline Pearl Drop:

- A photo tagged **Gold** and **Blue** shows when the customer picks Gold and Blue.
- A photo tagged **Gold** and **Any** shows for a Gold colour that has no photo of its own.
- A photo tagged **Any** and **Any** is a general photo. It shows when nothing more specific matches.
- If one combination still has no photo, the page uses another photo from the same design.
- If the design has no photos at all, the page shows a plain placeholder.

The product page can show more than one photo for the choice the customer made. Ring size does not change the photos.

Upload real photos only. They go on the live website.

The dashboard box for designs without photos links to what is still missing.

## Day-to-day stock

**Inventory** lists every item.

- **+ Received** adds a delivery on top of what you already have.
- **Set** types the exact number after you count. If a sale happens while you are typing, it stops and shows the real number. Check it, then try again.
- **History** lists sales, cancellations, your edits, and imports. It does not say which person clicked the button.

Sales and cancellations update the numbers for you. Do not subtract a sale by hand.

## Excel

Use Excel rarely after launch. For a new delivery or a count, use **Received** or **Set**.

**Export to Excel** downloads a copy. It does not change the website.

**Import from Excel** is for a big update from a spreadsheet.

1. Choose the file.
2. Click **Preview changes**. Nothing is saved yet. Read the preview.
3. Click **Apply** only if the preview is right.

After the shop has orders, import does **not** replace stock numbers unless you tick the box. Leave that box unticked unless the file is a fresh count that already includes every sale.

An old file is dangerous. It can rename designs and change prices. If you tick the stock box, it can also put old quantities back and undo sales. Rows that are on the website but missing from the file are left as they are. Import does not delete them. Import does not add or remove the photos customers see. The Photo Ref column is only a note in the sheet.

Ask a developer before a large import. The preview file is kept on the computer running the site, and a hosted site may not allow that.

## When an order arrives

Open **Orders → Needs action**.

1. **Start packing.** The order becomes Processing.
2. **Mark as shipped.** Choose your own delivery, or a courier, and add a tracking number if you have one.
3. **Delivered.** For cash on delivery, this also records that the cash was collected.

**Cancel** before shipping asks for a reason and puts the items back in stock.

The order page shows who changed the status. It uses the email of the person who was signed in.

Use **Call**, **WhatsApp**, or **Email** to reach the customer. **Notes** are for your team. Customers never see them. **Print packing slip** is for the parcel.

Search by order number, name, phone, email, or tracking number. **From** and **To** filter by date. **Export to Excel** downloads the orders you are looking at. That download does not change the orders.

## Homepage

**Homepage** is the big banner and the thin promotion strip.

Upload the banner here, not on cloudinary.com. Use a wide photo, and a tall photo for phones if you want one. Write the heading, the line under it, and the button. Tick **Show the banner** to put it on the site. Untick it to hide it without deleting it.

A promotion needs a headline. The extra line, button, and dates are optional. It can turn on and off by itself. If two are on at once, the newer one shows.

The category pictures on the home page are not edited here.

## Mailing list

**Subscribers** is everyone who typed an email on the website. **Export to Excel** downloads the list. **Remove** takes someone off it. Signing up does not send them an email.

## Settings to fill in

- **Announcement** — the line at the very top of the website.
- **Instagram** — the link used by the Instagram icon.
- **About** — the short text in the footer.
- **Support email** — the address on the returns page.
- **Shipping fee** — one flat fee for Pakistan.
- **Low-stock limit** — at or below this number, customers see “Only N left”.

Changes show on the website straight away.

If announcement, Instagram, or About is left empty, the website keeps its built-in text. If support email is empty, the returns page does not show an email address.

## For the developer

Photo uploads need `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env`, or one `CLOUDINARY_URL`. The computer’s clock must be correct, or the upload is refused. Without those values, a photo is saved only on that laptop.
