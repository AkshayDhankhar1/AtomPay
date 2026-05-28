const SibApiV3Sdk = require("sib-api-v3-sdk");

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const sendOTPEmail = async (email, otp) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  await apiInstance.sendTransacEmail({
    sender: { email: "akshay.dhankhar.ji@gmail.com", name: "AtomPay" },
    to: [{ email }],
    subject: "Your AtomPay OTP ⚡",
    // FIX: OTP step is 60s with window=1, so it actually expires in ~2 minutes, not 10
    htmlContent: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto">
        <h2 style="color:#FF5722">⚡ AtomPay</h2>
        <p>Your verification OTP:</p>
        <h1 style="color:#FF5722;letter-spacing:8px">${otp}</h1>
        <p>This OTP expires in <strong>2 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `
  });
};

module.exports = sendOTPEmail;
