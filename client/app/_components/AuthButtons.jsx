import Link from "next/link";

function AuthButtons() {
   return (
      <div className="flex items-center gap-4">
         <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-blue-400 transition-colors"
         >
            Sign In
         </Link>
         <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all duration-200 shadow-md shadow-blue-900/20"
         >
            Sign Up
         </Link>
      </div>
   );
}

export default AuthButtons;