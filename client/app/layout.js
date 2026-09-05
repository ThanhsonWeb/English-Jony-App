import { Analytics } from "@vercel/analytics/next";
import "./_styles/globals.css";
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
	const themeScript = `
		(function () {
			try {
				var preference = localStorage.getItem("studyjony-theme");
				if (!["light", "dark", "system"].includes(preference)) preference = "system";
				var resolved = preference === "system"
					? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
					: preference;
				document.documentElement.dataset.theme = resolved;
				document.documentElement.dataset.themePreference = preference;
				document.documentElement.style.colorScheme = resolved;
			} catch {}
		})();
	`;

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
