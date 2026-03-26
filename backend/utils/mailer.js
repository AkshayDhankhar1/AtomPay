const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,        // add this
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
    }
});

const sendOTPEmail = async (email, otp) => {
    await transporter.sendMail({
        from: `"AtomPay ⚡" <${process.env.EMAIL}>`,
        to: email,
        subject: "Your AtomPay Login OTP",
        html: `
            <div style="font-family:sans-serif;max-width:400px;margin:auto">
                <h2 style="color:#125722">⚡ AtomPay</h2>
                <p>Login OTP:</p>
                <h1 style="color:#125722;letter-spacing:8px;font-size:36px">
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