const zod=require("zod");
exports.signupSchema=zod.object({
    name : zod.string().min(1).max(50).trim(),
    email : zod.string().email(),
    password :zod.string().min(8).max(32),
    username :zod.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/), // yaha agar + nhi lagate toh ye kaval ek char valid hota matlab ye given thing ek baar hi aa sakti h but + let us use them more than once
    pin:zod.string().regex(/^\d{6}$/) // ^matlab string yahi se chalu honi chahiye  d matlab digit(0-9) $ matlab yha khatam string

})
exports.loginSchema=zod.object({
    email :zod.string().email(),
    password :zod.string().min(4)
})
exports.changePasswordSchema=zod.object({
    oldPassword : zod.string().min(1),
    newPassword : zod.string().min(8).max(32)
})
exports.changePinSchema=zod.object({
    oldPin : zod.string().regex(/^\d{6}$/),
    newPin : zod.string().regex(/^\d{6}$/)
})