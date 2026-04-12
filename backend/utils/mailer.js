const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (to, otp) => {
  const { error } = await resend.emails.send({
    from: 'AtomPay <onboarding@resend.dev>',
    to,
    subject: 'Your AtomPay OTP',
    html: `<div style="font-family:sans-serif;max-width:400px;margin:auto">
                   <h2 style="color:#FF5722">⚡ AtomPay</h2>
                   <p>Login OTP:</p>
                   <h1 style="color:#FF5722;letter-spacing:8px;font-size:36px">
                       ${otp}
                   </h1>
                   <p>10 minutes mein expire hoga.</p>
                   <p style="color:#999;font-size:12px">
                       Agar tumne request nahi ki — ignore karo.
                   </p>
                </div>`
  });
  
  if (error) throw new Error(error.message);
};

module.exports = sendOTPEmail;
