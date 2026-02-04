import { Joi } from "celebrate";

export const NAMESPACES = {
  nonceV2: "noncev2",
  pubNonceV2: "pub_noncev2",
};

export const RESERVED_NAMESPACES = [NAMESPACES.nonceV2, NAMESPACES.pubNonceV2];

export const validateSetData = Joi.object({
  namespace: Joi.string().max(128),
  pub_key_X: Joi.string().max(64).hex().required(),
  pub_key_Y: Joi.string().max(64).hex().required(),
  set_data: Joi.object({
    data: Joi.string().required(),
    timestamp: Joi.string().hex().required(),
  }).required(),
  signature: Joi.string().max(88).required(),
});
