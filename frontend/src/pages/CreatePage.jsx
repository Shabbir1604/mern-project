import React, { useState } from "react";
import
    {
        Box,
        Button,
        Container,
        Heading,
        Input,
        useColorModeValue,
        useToast,
        VStack,
    } from "@chakra-ui/react";
import { useProductStore } from "../store/product";

const CreatePage = () =>
{
    const [newProduct, setNewProduct] = useState({
        name: "",
        price: "",
        image: "",
    });

    const { createProduct } = useProductStore();
    const toast = useToast();

    const handleAddProduct = async () =>
    {
        if (!newProduct.name || !newProduct.price || !newProduct.image)
        {
            toast({
                title: "Error",
                description: "Please fill in all fields.",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        const { success, message } = await createProduct(newProduct);
        toast({
            title: success ? "Success" : "Error",
            description: message,
            status: success ? "success" : "error",
            duration: 3000,
            isClosable: true,
        });

        // Reset form after successful submission
        if (success)
        {
            setNewProduct({
                name: "",
                price: "",
                image: "",
            });
        }
    };

    return (
        <Container maxW={"container.sm"}>
            <Heading as={"h1"} size={"2xl"} textAlign={"center"} mb={8}>
                Create New Product
            </Heading>
            <Box
                w={"full"}
                bg={useColorModeValue("white", "gray.800")}
                p={6}
                rounded={"lg"}
                shadow={"md"}
            >
                <VStack spacing={4}>
                    <Input
                        placeholder="Product Name"
                        name="name"
                        value={newProduct.name}
                        onChange={(e) =>
                            setNewProduct({ ...newProduct, name: e.target.value })
                        }
                    />
                    <Input
                        placeholder="Price"
                        name="price"
                        type="number"
                        value={newProduct.price}
                        onChange={(e) =>
                            setNewProduct({ ...newProduct, price: e.target.value })
                        }
                    />
                    <Input
                        placeholder="Image URL"
                        name="image"
                        value={newProduct.image}
                        onChange={(e) =>
                            setNewProduct({ ...newProduct, image: e.target.value })
                        }
                    />
                    <Button colorScheme="blue" onClick={handleAddProduct} w="full">
                        Add Product
                    </Button>
                </VStack>
            </Box>
        </Container>
    );
};

export default CreatePage;
