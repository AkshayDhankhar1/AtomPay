const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,     
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

const sendOTPEmail = async (email, otp) => {
    await transporter.sendMail({
        from: `"AtomPay ⚡" <${process.env.EMAIL}>`,
        to: email,
        subject: "Your AtomPay Login OTP",
        html: `
            <div style="font-family:sans-serif;max-width:400px;margin:auto">
                <h2 style="color:#FF5722">⚡ AtomPay</h2>
                <p>Login OTP:</p>
                <h1 style="color:#FF5722;letter-spacing:8px;font-size:36px">
                    ${otp}
                </h1>
                <p>10 minutes mein expire hoga.</p>
                <p style="color:#999;font-size:12px">
                    Agar tumne request nahi ki — ignore karo.
                </p>
            </div>
        `
    });
};

module.exports = sendOTPEmail;
