# Frame Image

Gallery ảnh công khai bằng React, TypeScript và Vite, lấy ảnh từ một folder Google Drive và toàn bộ folder con. Giao diện tiếng Việt có sáng/tối, breadcrumb, tìm tên file toàn thư viện, phân trang, lightbox và tải ảnh gốc. Không có đăng nhập hoặc cơ sở dữ liệu.

Font DM Sans và Playfair Display được phục vụ từ `public/fonts/`, có bộ ký tự tiếng Việt và giấy phép OFL đi kèm. Trình duyệt không cần gọi Google Fonts khi mở trang.

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

Để triển khai serverless, dùng Fetch handler trong `server/serverless.ts`, đưa environment bindings phía server vào handler và route toàn bộ `/api/gallery` cùng các đường dẫn con tới function. Host static phục vụ `dist/`; không đưa mã server hoặc `.env` vào thư mục static. Có thể dùng `createGalleryHandler` trực tiếp cho adapter của nhà cung cấp. Dự án chưa chọn hoặc triển khai một nhà cung cấp cụ thể.

Trước khi public, xác nhận giới hạn key tương thích với host, giới hạn lượt gọi/thời gian chạy ở host, quota Drive và chi phí thumbnail. Cache là tạm thời, Drive vẫn là nguồn dữ liệu chính.

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

Tài liệu tham chiếu: [Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [Drive resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys), [Drive files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [Vite static deploy](https://vite.dev/guide/static-deploy).
