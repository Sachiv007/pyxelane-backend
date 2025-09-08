import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./MyStats.css";

export default function MyStats() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrder: 0,
    lastOrderDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) console.error("Error fetching user:", error.message);
      setUser(user);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            `
            id,
            created_at,
            buyer_email,
            product_id,
            products!inner (
              id,
              price,
              user_id
            )
          `
          )
          .eq("products.user_id", user.id); // ✅ filter on seller id at the DB level

        if (error) throw error;

        if (data && data.length > 0) {
          const totalSales = data.length;
          const totalRevenue = data.reduce(
            (sum, order) => sum + (order.products?.price || 0),
            0
          );
          const averageOrder = totalSales ? totalRevenue / totalSales : 0;

          const lastOrderDate = data
            .map((order) => new Date(order.created_at))
            .sort((a, b) => b - a)[0];

          setStats({
            totalSales,
            totalRevenue,
            averageOrder,
            lastOrderDate: lastOrderDate
              ? lastOrderDate.toLocaleString()
              : null,
          });
        } else {
          setStats({
            totalSales: 0,
            totalRevenue: 0,
            averageOrder: 0,
            lastOrderDate: null,
          });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // 👀 Real-time updates on orders
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          console.log("Realtime update in orders:", payload);
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <p>Loading stats...</p>;

  return (
    <div className="mystats-container">
      <h1>My Stats</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Sales</h3>
          <p>{stats.totalSales}</p>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>${stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Average Order</h3>
          <p>${stats.averageOrder.toFixed(2)}</p>
        </div>
        {stats.lastOrderDate && (
          <div className="stat-card">
            <h3>Last Sale</h3>
            <p>{stats.lastOrderDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}
