export default function TermsOfUsePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h1 className="text-3xl font-bold text-foreground">Điều khoản sử dụng</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: 12/03/2026</p>

        <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
          <p>
            SFund là công cụ hỗ trợ theo dõi thông tin tài chính và quản lý dữ liệu cá nhân. Ứng dụng không phải là lời
            khuyên đầu tư, tài chính hay pháp lý.
          </p>
          <p>
            Người dùng chịu trách nhiệm với các quyết định đầu tư của mình và cần tự đánh giá độ chính xác, mức độ phù
            hợp của thông tin trước khi hành động.
          </p>
          <p>
            Bạn đồng ý sử dụng ứng dụng đúng pháp luật, không xâm nhập dữ liệu của người khác, không lạm dụng hệ thống
            xác thực và không thực hiện hành vi gây gián đoạn dịch vụ.
          </p>
          <p>
            Chúng tôi có thể cập nhật tính năng, giao diện hoặc nội dung điều khoản khi cần thiết. Phiên bản mới sẽ có
            hiệu lực từ thời điểm được đăng trong ứng dụng.
          </p>
          <p>
            Nếu bạn không đồng ý với các điều khoản này, vui lòng ngừng sử dụng SFund.
          </p>
        </div>
      </div>
    </div>
  );
}
