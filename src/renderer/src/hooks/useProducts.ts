// src/renderer/src/hooks/useProducts.ts
import { useState, useCallback } from "react";
import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductFilters,
  ProductStats,
} from "../../../types/shared";

interface UseProductsReturn {
  products: Product[];
  total: number;
  stats: ProductStats | null;
  loading: boolean;
  error: string | null;
  fetchProducts: (filters?: ProductFilters) => Promise<void>;
  fetchStats: () => Promise<void>;
  createProduct: (dto: CreateProductDto) => Promise<Product | null>;
  updateProduct: (id: string, dto: UpdateProductDto) => Promise<Product | null>;
  updateStatusByImei: (imei: string, status: string) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  findByImei: (imei: string) => Promise<Product | null>;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (filters?: ProductFilters) => {
    setLoading(true);
    setError(null);
    try {
      // @ts-expect-error
      const res = await window.api.product.findAll(filters);
      if (res.success && res.data) {
        const data = res.data as { products: Product[]; total: number };
        setProducts(data.products);
        setTotal(data.total);
      } else {
        setError(res.error ?? "Failed to fetch products");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // @ts-expect-error
      const res = await window.api.product.stats();
      if (res.success && res.data) {
        setStats(res.data as ProductStats);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const createProduct = useCallback(
    async (dto: CreateProductDto): Promise<Product | null> => {
      // @ts-expect-error
      const res = await window.api.product.create(dto);
      if (res.success && res.data) return res.data as Product;
      throw new Error(res.error ?? "Failed to create product");
    },
    [],
  );

  const updateProduct = useCallback(
    async (id: string, dto: UpdateProductDto): Promise<Product | null> => {
      // @ts-expect-error
      const res = await window.api.product.update(id, dto);
      if (res.success && res.data) return res.data as Product;
      throw new Error(res.error ?? "Failed to update product");
    },
    [],
  );

  const updateStatusByImei = useCallback(
    async (imei: string, status: string): Promise<Product | null> => {
      // @ts-expect-error
      const res = await window.api.product.updateStatus(imei, status);
      if (res.success && res.data) return res.data as Product;
      throw new Error(res.error ?? "Failed to update status");
    },
    [],
  );

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    // @ts-expect-error
    const res = await window.api.product.delete(id);
    return res.success;
  }, []);

  const findByImei = useCallback(
    async (imei: string): Promise<Product | null> => {
      // @ts-expect-error
      const res = await window.api.product.findByImei(imei);
      if (res.success && res.data) {
        return (res.data as { product: Product | null }).product;
      }
      return null;
    },
    [],
  );

  return {
    products,
    total,
    stats,
    loading,
    error,
    fetchProducts,
    fetchStats,
    createProduct,
    updateProduct,
    updateStatusByImei,
    deleteProduct,
    findByImei,
  };
}
