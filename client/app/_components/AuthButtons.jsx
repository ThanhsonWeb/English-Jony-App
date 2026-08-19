import Link from "next/link";

function AuthButtons() {
	return (
		<div className=" flex items-center gap-4">
			<Link
				href="/login"
				className="px-4 py-2 text-md font-medium text-slate-200 hover:text-blue-400 transition-colors border "
			>
				Đăng nhập
			</Link>
			<Link
				href="/signup"
				className="px-4 py-2 text-md font-medium text-gray-100 bg-blue-700 hover:bg-blue-600 rounded-lg transition-all duration-200 shadow-md shadow-blue-900/20"
			>
				Đăng ký
			</Link>
		</div>
	);
}

export default AuthButtons;
