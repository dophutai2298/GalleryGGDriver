# Frame Image

Gallery ảnh công khai bằng React, TypeScript và Vite, lấy ảnh từ một folder Google Drive và toàn bộ folder con. Giao diện tiếng Việt có sáng/tối, breadcrumb, tìm tên file toàn thư viện, phân trang, lightbox và tải ảnh gốc. Không có đăng nhập hoặc cơ sở dữ liệu.

Font DM Sans và Playfair Display được phục vụ từ `public/fonts/`, có bộ ký tự tiếng Việt và giấy phép OFL đi kèm. Trình duyệt không cần gọi Google Fonts khi mở trang.

## Điều hướng album và giao diện

Menu hiển thị các folder con trực tiếp của Drive root, theo thứ tự Drive trả về, và tự mở album đầu tiên. Danh sách album đọc đủ các trang của root; ảnh nằm ngay ở root không được đưa vào màn hình album mặc định. Tìm theo tên ảnh vẫn tìm trên toàn bộ cây gallery.

Nút quay lại trên thanh điều hướng đưa khách từ album con về album trước, từ album cấp đầu về danh sách album; khi đang tìm kiếm, nút trở về album đang xem. Nút lên đầu trang cố định xuất hiện sau khi cuộn và ẩn trong lightbox. Các điều khiển chính có vùng chạm từ 44px; ô tìm kiếm dùng chữ 16px và bố cục thích ứng điện thoại, tablet, desktop. Hai giao diện sáng/tối dùng chung hệ màu.

Logo hoa sen và các icon dùng Phosphor. Favicon được xuất từ cùng icon `FlowerLotus` dạng duotone; giấy phép MIT của asset ở `public/icon-LICENSE.txt`.

## Chạy với Google Drive thật

Yêu cầu Node.js 24 trở lên.

```sh
npm install
# Sao chép .env.example thành .env và điền cấu hình phía server.
npm run dev
```

`GOOGLE_DRIVE_API_KEY` là key riêng cho phía server, bật và giới hạn Google Drive API. Tên cũ `API_KEY_GOOGLE` cũng được hỗ trợ. Cấu hình `GOOGLE_DRIVE_ROOT_FOLDER_URL` bằng link folder công khai; hoặc dùng `GOOGLE_DRIVE_ROOT_FOLDER_ID` và tuỳ chọn `GOOGLE_DRIVE_ROOT_RESOURCE_KEY`. Mọi file được hiển thị đều phải cho phép truy cập công khai.

Không đặt key vào biến có tiền tố `VITE_`. Không commit `.env`. Key bị giới hạn bằng HTTP referrer có thể không dùng được phía server; chọn giới hạn ứng dụng phù hợp với nơi chạy proxy khi triển khai.

```sh
npm run build
npm start
```

`npm start` phục vụ `dist/` và API cùng tên miền tại `http://127.0.0.1:3000`. Có thể đặt `HOST` và `PORT` khi triển khai. `npm run build` chạy typecheck và kiểm tra key cấu hình không xuất hiện trong frontend build. `npm run preview` cũng có API để xem thử local.

## Kiến trúc và triển khai

- Frontend gọi `/api/gallery` để đọc folder hoặc tìm tên file. Mỗi kết quả có đường dẫn folder và endpoint thumbnail/xem trước cùng tên miền.
- Backend chỉ gọi Drive cho root cấu hình và các nội dung được chứng minh thuộc cây root bằng `files.list`. Cách này hoạt động cả khi metadata công khai không có trường `parents`; shortcut không được đi theo.
- Một trang Drive có tối đa 1.000 mục. Tìm kiếm đi qua các trang và folder con, trả từng trang 200 ảnh; giới hạn bảo vệ là 50.000 mục hoặc khoảng 45 giây quét. Nếu vượt giới hạn, API báo lỗi thay vì trả kết quả thiếu mà không thông báo.
- Cache metadata, kết quả tìm kiếm và thumbnail có thời hạn 30 giây. Mở lại/tải lại folder lấy danh sách mới. Thumbnail cache giới hạn 32 MiB/128 ảnh; mỗi thumbnail tối đa 8 MiB. Các request đồng thời có thể chia sẻ dữ liệu đang tải.
- Grid tải thumbnail khi cần; lightbox chỉ tải bản xem trước khi mở. Proxy không tải binary ảnh gốc. Nút tải xuống lấy link tải công khai từ Drive.
- Link thumbnail ngắn hạn được lấy lại khi retry; ảnh không có thumbnail có ô báo riêng. Kích thước CDN là tối ưu theo khả năng Google hỗ trợ, không phải cam kết chất lượng ảnh gốc.
- Các lỗi API, quota, mạng và media được đổi thành thông báo an toàn bằng tiếng Việt.

Vercel phục vụ frontend từ `dist/` và phát hiện Node function tại `api/gallery.ts`. Function đọc environment variables phía server và dùng cùng gallery handler với local. `vercel.json` rewrite các đường dẫn ảnh dưới `/api/gallery/` về function này, giữ URL và query của request. Không đưa mã server hoặc `.env` vào thư mục static. Fetch handler trong `server/serverless.ts` vẫn có thể dùng cho host khác có environment bindings.

`tsconfig.json` bật `rewriteRelativeImportExtensions` để function sau khi biên dịch import `.js` thay vì `.ts`. Frontend build thành công chưa đủ để xác nhận function khởi động được; khi kiểm tra đóng gói Vercel phải kiểm tra cả function output.

Trước khi public, xác nhận giới hạn key tương thích với host, giới hạn lượt gọi/thời gian chạy ở host, quota Drive và chi phí thumbnail. Cache là tạm thời, Drive vẫn là nguồn dữ liệu chính.

## Triển khai trên Vercel

1. Deploy commit có cả `api/` và `vercel.json`. Đặt **Root Directory** là gốc repo, **Framework Preset** là Vite, Node.js **24.x**. Build command là `npm run build`, output directory là `dist`; cấu hình trong repo đã khai báo hai giá trị này.
2. Đặt `GOOGLE_DRIVE_API_KEY` hoặc tên cũ `API_KEY_GOOGLE` trong Environment Variables phía server. Đặt `GOOGLE_DRIVE_ROOT_FOLDER_URL` hoặc `GOOGLE_DRIVE_ROOT_FOLDER_ID`; thêm `GOOGLE_DRIVE_ROOT_RESOURCE_KEY` nếu link yêu cầu. Không thêm tiền tố `VITE_`.
3. Chọn đúng môi trường **Production** và/hoặc **Preview** cần dùng, sau đó **Redeploy** commit mới. Đổi env không cập nhật một deployment đã chạy. Function sẽ xuất hiện trong phần Functions của deployment.
4. Kiểm tra URL deployment bằng lệnh sau; không cần gửi key lên trình duyệt hay truyền key cho script:

```sh
npm run check:live -- https://weeding-taitruc.vercel.app
```

Script kiểm tra HTML trang chính, JSON gallery, một thumbnail, preview và link tải ảnh gốc qua HTTP. Script không tải binary ảnh gốc; nó chỉ xem một số folder/ảnh đại diện, không kiểm kê toàn bộ Drive.

| Kết quả | Ý nghĩa và bước xử lý |
| --- | --- |
| `/` trả 200 HTML, `/api/gallery` trả 200 JSON | Frontend và function đã được route đúng. |
| 404 dạng text/HTML kèm `x-vercel-error: NOT_FOUND` | Vercel chưa tìm thấy function hoặc route. Kiểm tra commit deploy, Root Directory và function output. Thêm env không tạo ra route còn thiếu. |
| 503 JSON với `NOT_CONFIGURED` | Function đã chạy nhưng thiếu key hoặc root folder hợp lệ trong env của deployment. Kiểm tra tên biến, môi trường và redeploy. |
| 404 JSON với `NOT_FOUND` | Request đã tới gallery; nội dung không thuộc root, không tồn tại hoặc chưa được chia sẻ công khai. |
| 502 JSON với `DRIVE_UNAVAILABLE` hoặc 429 với `RATE_LIMITED` | Routing đã hoạt động; kiểm tra Drive API, giới hạn key, chia sẻ folder hoặc quota. |

Function chạy Node.js 24.x, giới hạn thời gian 60 giây. Các instance và cache có thể được tạo lại bất cứ lúc nào. Nếu dùng CLI để kiểm tra cách Vercel đóng gói, chạy `vercel pull` với project đã liên kết rồi `vercel build`; không commit `.vercel/`.

## Kiểm thử

```sh
npm run typecheck
npx playwright install chromium
npm test
```

Nếu dùng Chrome/Edge đã cài sẵn trên Windows, có thể đặt `$env:PLAYWRIGHT_CHANNEL='chrome'` hoặc `'msedge'` trong PowerShell trước `npm test`.

`test:api` kiểm tra API thật của ứng dụng với fake Drive ở điểm outbound transport đã thống nhất. Fixture bao gồm folder sâu, metadata thiếu `parents`, hơn 1.000 ảnh, thay đổi nguồn, MIME không hỗ trợ, quota, link media không an toàn, thumbnail thiếu và tải xuống không khả dụng.

`test:browser` chạy frontend và API thật với cùng fake Drive. Bộ test bao gồm desktop/mobile, phân trang, tìm toàn thư viện, trạng thái tải/rỗng/lỗi/quota, lightbox, download, focus và lưu theme. Test server dùng port 5174 và 5175, được đóng sau khi chạy. Không dùng quota Drive thật.

```sh
npm run dev:fixture
# Kiểm tra thủ công với folder thật, chỉ khi đã cấu hình .env:
npm run check:live
```

`check:live` đọc một số folder, kiểm tra thumbnail và link tải. Script không tải binary ảnh gốc và không in key. Cần kiểm tra một lần trong trình duyệt trên host cuối cùng: mở folder, tìm ảnh, xem lightbox và tải ảnh gốc để xác nhận hành vi tải công khai của Drive.

Tài liệu tham chiếu: [Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [Drive resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys), [Drive files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [Vite static deploy](https://vite.dev/guide/static-deploy), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [TypeScript import rewriting](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths).
