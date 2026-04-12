const Brevo = require("@getbrevo/brevo");

const client = Brevo.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const sendOTPEmail = async (email, otp) => {
  const apiInstance = new Brevo.TransactionalEmailsApi();
  await apiInstance.sendTransacEmail({
    sender: { email: "akshaydhankhar62@gmail.com", name: "AtomPay" },
    to: [{ email }],
    subject: "Your AtomPay OTP ⚡",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto">
        <h2 style="color:#FF5722">⚡ AtomPay</h2>
        <p>Your Login OTP:</p>
        <h1 style="color:#FF5722;letter-spacing:8px">${otp}</h1>
        <p>Expires in 10 minutes.</p>
      </div>
    `
  });
};

module.exports = sendOTPEmail;