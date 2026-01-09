import nodemailer from 'nodemailer';
export async function sendEmail({ to, subject, text }) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
        return { sent: false, message: 'Email not configured; skipping send' };
    }
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    try {
        await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
        return { sent: true, message: 'Email sent' };
    }
    catch (err) {
        return { sent: false, message: err.message };
    }
}
