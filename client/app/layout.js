import { Geist, Geist_Mono } from "next/font/google";
import "./_styles/globals.css";
import Header from "./_components/Header";
import { Inter } from "next/font/google";
//  Configure font 🔤
const inter = Inter({
	subsets: ["latin"],
	display: "swap",
});

export const metadata = {
	title: { template: "%s || English Jony", default: " English Jony" },
	description: "Welcome to English-Jony start your journey here !",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en" className={inter.className}>
			<body className="min-h-full flex flex-co ">
				<Header />
				{children}
			</body>
		</html>
	);
}
