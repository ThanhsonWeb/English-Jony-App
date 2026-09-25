import Link from "next/link";

function AuthButtons() {
	return (
		<div className="flex items-center gap-4">
			<Link
				href="/login"
				className="text-md rounded-lg bg-primary px-4 py-2 font-medium text-white shadow-md shadow-blue-900/20 transition-all duration-200 hover:brightness-110"
			>
				Đăng nhập
			</Link>
			{/* <Link
				href="/signup"
				className="text-md rounded-lg bg-primary px-4 py-2 font-medium text-white shadow-md shadow-blue-900/20 transition-all duration-200 hover:brightness-110"
			>
				Đăng ký
			</Link> */}
		</div>
	);
}

export default AuthButtons;
