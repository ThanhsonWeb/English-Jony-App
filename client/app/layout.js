import { Analytics } from "@vercel/analytics/next";
import "./_styles/globals.css";
import { themeScript } from "./_lib/theme.mjs";
import { Inter } from "next/font/google";
import { AuthProvider } from "./_contexts/AuthContext";
import { ThemeProvider } from "./_contexts/ThemeContext";
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
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body className="flex min-h-full flex-col bg-page text-main">
				<ThemeProvider>
					<AuthProvider>
						<Analytics />
						{children}
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
