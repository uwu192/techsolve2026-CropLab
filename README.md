
🎓 CropLabs - Teacher Assistant AI

**Cuộc thi:** Techsolve 2026 **Tên đội:** CropLab 

👥 Danh sách thành viên 

* **N25DCCN147** – Nguyễn Thành Tâm 


* **N25DCCN117** – Nguyễn Huy Khang 


* **N25DCCN105** – Lê Quán Hiếu 



---

1. The Problem 

* **Vấn đề đội chọn:**
Quá trình chấm bài tự luận của giáo viên đang gặp phải nút thắt lớn về thời gian và độ chính xác, đặc biệt là khi đối mặt với chữ viết tay tiếng Việt. Các công cụ AI thông thường dễ bị mất bối cảnh khi đọc file hình ảnh và thường xuyên bị ảo giác khi gặp chữ viết tay khó đọc.


* **Liên hệ với từ khóa – AI Driven Innovation:**
Vấn đề này đòi hỏi một hệ thống AI không chỉ đơn thuần là gọi API hay sử dụng chatbot, mà phải là một kiến trúc *Multi-Agent AI* gồm nhiều agent khác nhau có khả năng tự kiểm chứng, đánh giá mức độ tin cậy và tự động hóa toàn bộ vòng đời chấm điểm từ lúc nhận bài đến khi trả điểm.


* **Bằng chứng/số liệu về tính cấp thiết:**
Khối lượng bài tập nộp qua Google Classroom là khổng lồ. Giáo viên cần một hệ thống bất biến để quản lý trạng thái nộp bài, chấm điểm và đồng bộ điểm số mà không xảy ra sai sót dữ liệu hay quá tải giới hạn bộ nhớ.



2. The Solution 

* **Mô tả tổng quan giải pháp:**
Teacher Assistant AI áp dụng kiến trúc Multi-Agent AI. Giải pháp chia quá trình chấm bài làm 2 giai đoạn:


* **Phase 1:**
Trích xuất văn bản song song với 2 agent AI. Reader Primary tập trung nhận diện chính xác hình ảnh, trong khi Reader Skeptical đóng vai trò phản biện, tìm kiếm các nét chữ rối và đánh dấu vùng không chắc chắn. Dữ liệu được đan xen theo cấu trúc `[Text Label] -> [Image/PDF Data]` để tránh context-drift.


* **Phase 2:**
Gộp các agent thành một Expert Panel duy nhất để tối ưu thời gian chạy. Các agent này đối chiếu bản dịch của 2 Reader, loại bỏ hallucination và áp dụng Rubric để chấm điểm.


* **Điểm sáng tạo:**
Khác biệt cốt lõi nằm ở luồng thực thi bền bỉ bằng Inngest và cơ chế chấm điểm qua 5 agent, đảm bảo độ trung thực cao nhất so với các giải pháp AI đơn luồng.


* **Đối tượng người dùng hướng đến:**
Giáo viên các cấp đang sử dụng hệ sinh thái Google Classroom cần tự động hóa khâu chấm chữa bài viết tay.



3. Tech Stack 

* **Framework:**
Next.js (App Router).


* **Runtime & Orchestration:**
Inngest (Xử lý Durable Execution & Điều phối AI pipeline).


* **Database:**
Supabase (PostgreSQL + Row Level Security - RLS).


* **AI Engine & Models** :
  - Vercel AI SDK.
  
  - Google Gemini 3.0 Flash (Experimental) – Mô hình chính.
  
  - Qwen2-VL (thông qua Together API) – Mã nguồn mở dự phòng.

* **Integrations:**
Google Classroom API (OAuth2) và Google Drive API (V3).



4. Key Features 

* **Hệ thống quét và đồng bộ đa luồng:** Quét toàn bộ khóa học, bài tập, danh sách học sinh từ Google Classroom (`app/actions/classroom.ts`). Kéo file trực tiếp từ Drive dưới dạng raw bytes để vượt qua giới hạn payload 4MB.


* **Dual-Reader Consensus Pipeline:** Tự động nhận diện, giải mã chữ viết tay tiếng Việt và gắn cờ cảnh báo nếu chữ quá khó đọc.


* **Expert Panel Grading & Draft Generation:** Tự động đối chiếu, chấm điểm theo barem (rubric), và xuất ra một bản nháp phản hồi (Markdown feedback) cho học sinh.


* **Review Canvas:** Màn hình Review cho phép giáo viên xem ảnh bài làm song song với bản dịch và điểm số đề xuất trước khi chốt điểm.


* **Resubmission:** Worker chạy ngầm tự động kiểm tra và xử lý khi học sinh nộp lại file mới (`inngest/resubmission-poller.ts`).


5. Setup & Installation 

**Yêu cầu hệ thống:** Node.js (v18+), môi trường quản lý package (npm/pnpm/yarn).

**Bước 1: Clone repository và cài đặt thư viện** 

```bash
git clone https://github.com/uwu192/techsolve2026-CropLab.git
cd techsolve2026-CropLab
npm install

```

**Bước 2: Cấu hình biến môi trường** 

Tạo file `.env.local` từ mẫu `.env.example` và điền các khóa sau:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_DB_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_ADMIN_KEY 
GOOGLE_GENERATIVE_AI_API_KEY=YOUR_GEMINI_KEY 
TOGETHER_API_KEY=YOUR_TOGETHER_KEY 
INNGEST_EVENT_KEY=local 
INNGEST_SIGNING_KEY=local 

```

**Bước 3: Khởi chạy Database**
Khởi chạy Supabase (nếu chạy local) và cập nhật Schema theo cấu trúc bảng submissions.

```bash
npx supabase migration list

```

Bước 4: Khởi chạy dự án Bạn cần mở 2 tab terminal riêng biệt:

Tab 1: Chạy Inngest dev server 

```bash
npx inngest-cli@latest dev

```

Tab 2: Chạy Next.js app 

```bash
npm run dev # 

```
