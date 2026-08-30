import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./_styles/globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./_contexts/AuthContext";
//  Configure font 🔤
const inter = Inter({
	subsets: ["latin"],
	display: "swap",
});

export const metadata = {
	title: {
		default: "StudyJony",
		template: "StudyJony | %s",
	},
	description: "Học tiếng Anh cùng StudyJony",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en" className={inter.className}>
			<body className="min-h-full flex flex-col ">
				<AuthProvider>
					<Analytics />
					{children}
				</AuthProvider>
			</body>
		</html>
	);
}
