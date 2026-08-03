const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
	// 1️⃣ Create transporter with Mailtrap
	const transporter = nodemailer.createTransport({
		host: "sandbox.smtp.mailtrap.io",
		port: 2525,
		auth: {
			user: process.env.MAILTRAP_USER,
			pass: process.env.MAILTRAP_PASS,
		},
	});

	// 2️⃣ Define email options
	const mailOptions = {
		from: '"Son Jony" sondeptroi@gmail.com',
		to: options.email,
		subject: options.subject,
		text: options.message,
		// html: options.html, // optional if you want styled HTML
	};

	// 3️⃣ Send email
	await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
