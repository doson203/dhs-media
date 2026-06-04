# Reup Tools Sales Web

Web gioi thieu va ban cac app desktop theo dang shop tool. Co trang khach xem va trang admin local de cap nhat noi dung, bang gia, video demo va file tai app.

## Chay local

```powershell
cd C:\reup_tools-20260514T120658Z-3-001\reup_tools\sales_web
npm install
$env:ADMIN_PASSWORD="mat-khau-cua-ban"
$env:SESSION_SECRET="chuoi-bi-mat-dai"
npm start
```

Trang ban hang:

```text
http://localhost:8080
```

Trang admin:

```text
http://localhost:8080/admin
```

Mat khau mac dinh khi chua set env la `admin123`. Khi deploy that phai doi.

## Build de up Vercel

Vercel phu hop voi ban public tinh. Trang web se doc du lieu tu:

```text
data/site.json
```

Chay lenh:

```powershell
cd C:\reup_tools-20260514T120658Z-3-001\reup_tools\sales_web
npm install
npm run build
```

Thu muc output la:

```text
sales_web/dist
```

Khi import len Vercel:

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Luu y: admin upload truc tiep khong luu ben vung tren Vercel neu chua tich hop Vercel Blob/Cloudflare R2. Ban public tren Vercel nen cap nhat bang cach sua `data/site.json`, build lai va push Git.

## Day len GitHub

Sau khi tao repo rong tren GitHub:

```powershell
cd C:\reup_tools-20260514T120658Z-3-001\reup_tools\sales_web
git remote add origin https://github.com/TAI_KHOAN/TEN_REPO.git
git branch -M main
git push -u origin main
```

Sau do vao Vercel, chon `Add New Project`, import repo GitHub nay va deploy.

## Cap nhat noi dung

Trong `/admin` co cac tab:

- `Thong tin chung`: brand, hero, lien he.
- `San pham app`: them/sua app, link demo, link download.
- `Bang gia`: them/sua goi gia.
- `Video demo`: them link demo hoac link file video da upload.
- `FAQ`: cau hoi thuong gap.
- `Upload file`: upload exe/zip/anh/video, copy URL de gan vao san pham.
- `JSON nang cao`: sua nhanh toan bo du lieu.

Du lieu duoc luu o:

```text
sales_web/data/site.json
```

File upload duoc luu o:

```text
sales_web/uploads
```

Khi backup/chuyen server, giu lai 2 duong dan nay.

## Deploy co admin online/upload file

Voi web ban app co upload file exe/zip va muon sua truc tiep tren web admin online, nen dung VPS hoac hosting Node co persistent disk, hoac nang cap sang Vercel Blob/Cloudflare R2.

Huong don gian:

1. Mua VPS Ubuntu.
2. Cai Node.js LTS.
3. Upload thu muc `sales_web` len server.
4. Chay:

```bash
npm install --omit=dev
ADMIN_PASSWORD="mat-khau-manh" SESSION_SECRET="chuoi-bi-mat-dai" PUBLIC_BASE_URL="https://tenmiencuaban.com" PORT=8080 npm start
```

5. Cai PM2 de app tu chay lai:

```bash
npm install -g pm2
pm2 start server.js --name app-sales-web
pm2 save
pm2 startup
```

6. Cai Nginx reverse proxy tu domain ve port 8080.
7. Cai SSL bang Certbot.

## Ten mien

Ban co the mua domain o Cloudflare Registrar, Namecheap hoac Porkbun. Sau khi co VPS:

- Tao DNS `A record`: `@` -> IP VPS.
- Tao DNS `A record` hoac `CNAME`: `www` -> domain chinh.
- Bat SSL/HTTPS.

Neu dung Cloudflare:

- Add domain vao Cloudflare.
- Tro nameserver theo Cloudflare.
- Tao `A record` ve VPS.
- Bat proxy/CDN neu muon.

## Luu y bao mat

- Doi `ADMIN_PASSWORD`.
- Doi `SESSION_SECRET`.
- Khong upload file nhay cam len public.
- File trong `uploads` la public de khach co the tai/xem.
- Neu can ban file rieng chi cho khach da mua, can them chuc nang link tai co token hoac tich hop thanh toan/key.

## Nang cap sau

- Tich hop thanh toan.
- Tao license/key tu dong.
- Link tai co han.
- Luu file len Cloudflare R2 hoac Vercel Blob khi luu luong tai cao.
- Trang quan ly don hang va khach hang.
