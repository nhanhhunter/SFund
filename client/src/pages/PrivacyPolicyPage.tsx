export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h1 className="text-3xl font-bold text-foreground">Chính sách bảo mật</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: 12/03/2026</p>

        <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
          <p>
            SFund thu thập tối thiểu các dữ liệu cần thiết để cung cấp tính năng đồng bộ danh mục đầu tư, danh sách theo
            dõi và cài đặt cá nhân cho từng tài khoản.
          </p>
          <p>
            Dữ liệu người dùng được lưu trữ trên Google Cloud Firestore và chỉ được truy cập bởi chính chủ tài khoản đã
            xác thực. Chúng tôi không bán dữ liệu cá nhân cho bên thứ ba.
          </p>
          <p>
            Thông tin có thể bao gồm email đăng nhập, tên hiển thị, biểu tượng đại diện, tùy chọn giao diện, danh mục
            đầu tư và danh sách theo dõi. Các dữ liệu này được dùng để vận hành ứng dụng và cá nhân hóa trải nghiệm.
          </p>
          <p>
            Người dùng có quyền cập nhật hoặc xóa dữ liệu trong phạm vi các tính năng được cung cấp trong ứng dụng.
            Nếu cần hỗ trợ thêm, vui lòng liên hệ qua trang liên hệ chính thức.
          </p>
          <p>
            Khi tiếp tục sử dụng SFund, bạn đồng ý với việc xử lý dữ liệu theo chính sách này.
          </p>
        </div>
      </div>
    </div>
  );
}
