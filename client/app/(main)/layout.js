import Header from "../_components/Header";

export default function MainLayout({ children }) {
	return (
		<>
			<Header />
			{children}
		</>
	);
}
